/**
 * QueryBuilder Utility
 * Helps building dynamic parameterized SQL queries with safe parameter substitution.
 */
class QueryBuilder {
    private conditions: string[] = [];
    private params: any[] = [];
    private paramCount = 0;

    /**
     * Adds a WHERE condition with a parameterized value.
     * Use '$' as a placeholder for the parameter.
     * 
     * @example qb.where('type = $', 'BKK')
     */
    where(condition: string, value: any): this {
        this.paramCount++;
        const substitutedCondition = condition.replace(/\$/, `$${this.paramCount}`);
        this.conditions.push(substitutedCondition);
        this.params.push(value);
        return this;
    }

    /**
     * Adds a WHERE condition only if the value is not null or undefined.
     */
    whereIf(condition: string, value: any): this {
        if (value === null || value === undefined || value === "") {
            return this;
        }
        return this.where(condition, value);
    }

    /**
     * Builds the final WHERE clause and params array.
     */
    build(): { whereClause: string; params: any[]; nextParamIndex: number } {
        const whereClause =
            this.conditions.length > 0
                ? `WHERE ${this.conditions.join(" AND ")}`
                : "";

        return {
            whereClause,
            params: this.params,
            nextParamIndex: this.paramCount + 1,
        };
    }
}

/**
 * Factory function to create a new QueryBuilder instance.
 */
export function createQueryBuilder() {
    return new QueryBuilder();
}

/**
 * Unit Test / Usage Example:
 * 
 * const { whereClause, params, nextParamIndex } = createQueryBuilder()
 *   .whereIf('type = $', 'BKK')
 *   .whereIf('division ILIKE $', undefined)
 *   .whereIf('status = $', 'approved')
 *   .build();
 * 
 * Expected: 
 *   whereClause: 'WHERE type = $1 AND status = $2'
 *   params: ['BKK', 'approved']
 *   nextParamIndex: 3
 */
