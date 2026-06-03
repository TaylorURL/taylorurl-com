const OPENAI_EMBEDDINGS_API = 'https://api.openai.com/v1/embeddings'

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIM = 1536

export async function embed(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const response = await fetch(OPENAI_EMBEDDINGS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)')
    throw new Error(`OpenAI embeddings ${response.status}: ${body}`)
  }

  const json = await response.json()
  const vector = json?.data?.[0]?.embedding
  if (!Array.isArray(vector)) {
    throw new Error('OpenAI embeddings: unexpected response shape')
  }
  return vector
}
