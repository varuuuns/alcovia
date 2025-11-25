import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

const sql = postgres(connectionString, {
    ssl: 'require',
    prepare: false
});

export async function query(text, params) {
    try {
        const result = await sql.unsafe(text, params);
        const rows = Array.isArray(result) ? result : Array.from(result);
        return { rows };
    } catch (err) {
        console.error('Database query failed:', err.message);
        throw new Error('Database operation failed');
    }
}

export default sql;