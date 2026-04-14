import type { ExtractedJsonLd } from './extract.js';

export type FindingSeverity = 'error' | 'warning' | 'info';

export interface Finding {
    severity: FindingSeverity;
    code: string;
    message: string;
    /** Optional pointer into the graph, e.g. an @id or JSON path. */
    path?: string;
}

export interface ValidatedBlock {
    scriptIndex: number;
    /** Shape of the payload after normalization. */
    shape: 'graph' | 'entity' | 'array' | 'invalid';
    /** Entities extracted from the payload (flattened from @graph/array). */
    entities: Entity[];
    findings: Finding[];
}

interface Entity {
    '@type'?: string | readonly string[];
    '@id'?: string;
    [key: string]: unknown;
}

/**
 * Walk a value recursively and collect every `{ '@id': string }` reference
 * that is NOT a top-level entity (i.e. doesn't have `@type`).
 * Mirrors the logic in seo-graph-core's assemble.ts.
 */
function collectReferences(value: unknown, refs: Set<string>): void {
    if (value === null || value === undefined || typeof value !== 'object') return;

    if (Array.isArray(value)) {
        for (const item of value) collectReferences(item, refs);
        return;
    }

    const obj = value as Record<string, unknown>;
    if (typeof obj['@id'] === 'string' && obj['@type'] === undefined) {
        refs.add(obj['@id']);
        return;
    }
    for (const val of Object.values(obj)) collectReferences(val, refs);
}

function normalize(payload: unknown): {
    shape: ValidatedBlock['shape'];
    entities: Entity[];
} {
    if (payload === null || typeof payload !== 'object') {
        return { shape: 'invalid', entities: [] };
    }
    if (Array.isArray(payload)) {
        return { shape: 'array', entities: payload.filter(isEntity) };
    }
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
        return { shape: 'graph', entities: obj['@graph'].filter(isEntity) };
    }
    if (isEntity(obj)) {
        return { shape: 'entity', entities: [obj] };
    }
    return { shape: 'invalid', entities: [] };
}

function isEntity(value: unknown): value is Entity {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a single JSON-LD block. Checks:
 *  - JSON parseability (caller passes parseError through)
 *  - Shape (graph/entity/array/invalid)
 *  - Every entity has @type
 *  - Every entity has @id (warning — not required, but seo-graph recommends)
 *  - Every { @id } reference resolves to an entity in the same block
 */
export function validateBlock(block: ExtractedJsonLd): ValidatedBlock {
    const findings: Finding[] = [];

    if (block.parseError) {
        return {
            scriptIndex: block.scriptIndex,
            shape: 'invalid',
            entities: [],
            findings: [
                {
                    severity: 'error',
                    code: 'invalid-json',
                    message: `JSON parse error: ${block.parseError}`,
                },
            ],
        };
    }

    const { shape, entities } = normalize(block.payload);

    if (shape === 'invalid') {
        findings.push({
            severity: 'error',
            code: 'invalid-shape',
            message: 'JSON-LD payload is neither an entity, a @graph, nor an array of entities.',
        });
        return { scriptIndex: block.scriptIndex, shape, entities, findings };
    }

    const entityIds = new Set<string>();
    for (const entity of entities) {
        if (typeof entity['@id'] === 'string') entityIds.add(entity['@id']);
    }

    for (const [i, entity] of entities.entries()) {
        const type = entity['@type'];
        if (type === undefined) {
            findings.push({
                severity: 'error',
                code: 'missing-type',
                message: `Entity at index ${i} has no @type.`,
                path: entity['@id'] ?? `#entity-${i}`,
            });
        }
        if (entity['@id'] === undefined) {
            findings.push({
                severity: 'warning',
                code: 'missing-id',
                message: `Entity of type ${String(type)} at index ${i} has no @id. Cross-references won't resolve.`,
                path: `#entity-${i}`,
            });
        }
    }

    const refs = new Set<string>();
    for (const entity of entities) {
        for (const [key, val] of Object.entries(entity)) {
            if (key === '@id') continue;
            collectReferences(val, refs);
        }
    }
    for (const ref of refs) {
        if (!entityIds.has(ref)) {
            findings.push({
                severity: 'warning',
                code: 'dangling-reference',
                message: `Reference { "@id": "${ref}" } does not resolve to any entity in this block.`,
                path: ref,
            });
        }
    }

    return { scriptIndex: block.scriptIndex, shape, entities, findings };
}
