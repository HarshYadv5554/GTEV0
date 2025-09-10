import { type NextRequest, NextResponse } from "next/server"

function chunkText(text: string, maxChunkSize = 6000): string[] {
  const sentences = text.split(/[।.!?]+/).filter((sentence) => sentence.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence
    } else {
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      currentChunk = trimmedSentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks.length > 0 ? chunks : [text]
}

export async function POST(request: NextRequest) {
  console.log("[v0] Translation API route called - starting execution")

  try {
    const { text, from, to } = await request.json()

    console.log("[v0] Translation request received, text length:", text?.length)
    console.log("[v0] From:", from, "To:", to)

    if (!text || !from || !to) {
      return NextResponse.json({ error: "Text, from, and to parameters are required" }, { status: 400 })
    }

    const isLongText = text.length > 4000

    const apiKey =
      process.env.OPENAI_API_KEY ||
      "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"

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    if (isLongText) {
      const chunks = chunkText(text, 6000)
      console.log("[v0] Split text into", chunks.length, "chunks")

      const translatedChunks: string[] = new Array(chunks.length)
      const BATCH_SIZE = 5

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE)
        console.log(`[v0] Translating batch ${i / BATCH_SIZE + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} of size ${batch.length}`)

        await Promise.all(
          batch.map(async (chunk, idx) => {
            const absoluteIndex = i + idx
            const prompt = `You are translating Gurmukhi (Punjabi script) text to English. This is part ${absoluteIndex + 1} of ${chunks.length} from a YouTube video transcript. Provide a natural, accurate English translation that maintains the original meaning and context.\n\nText to translate:\n${chunk}`

            const completion = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content:
                      "You are a professional translator specializing in Gurmukhi (Punjabi) to English translation. You understand religious, cultural, and contextual nuances. Provide accurate, natural translations that preserve the meaning and context of the original text.",
                  },
                  {
                    role: "user",
                    content: prompt,
                  },
                ],
                max_tokens: 2000,
                temperature: 0.3,
              }),
            })

            if (!completion.ok) {
              const errorText = await completion.text()
              throw new Error(`Translation failed for chunk ${absoluteIndex + 1}: ${errorText}`)
            }

            const completionData = await completion.json()
            const translatedChunk = completionData.choices[0]?.message?.content?.trim()
            if (!translatedChunk) throw new Error(`No translation received for chunk ${absoluteIndex + 1}`)

            translatedChunks[absoluteIndex] = translatedChunk
          }),
        )
      }

      const finalTranslation = translatedChunks.join(" ")
      console.log("[v0] All chunks translated successfully, final length:", finalTranslation.length)

      return NextResponse.json({
        translatedText: finalTranslation,
        originalText: text,
        fromLanguage: from,
        toLanguage: to,
        chunksProcessed: chunks.length,
      })
    }

    const prompt = `You are translating Gurmukhi (Punjabi script) text to English. The text is from a YouTube video transcript. Please provide a natural, accurate English translation that maintains the original meaning and context.\n\nText to translate:\n${text}`

    console.log("[v0] Sending request to OpenAI with model gpt-4o-mini...")

    try {
      const completion = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a professional translator specializing in Gurmukhi (Punjabi) to English translation. You understand religious, cultural, and contextual nuances. Provide accurate, natural translations that preserve the meaning and context of the original text.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      })

      if (!completion.ok) {
        const errorData = await completion.json()
        console.error("[v0] OpenAI API error:", errorData)

        let errorMessage = "OpenAI API error"
        const statusCode = completion.status

        if (statusCode === 401) {
          errorMessage = "Invalid OpenAI API key. Please check your API key."
        } else if (statusCode === 429) {
          errorMessage = "OpenAI API rate limit exceeded. Please try again later."
        } else if (statusCode === 402) {
          errorMessage = "OpenAI API quota exceeded. Please check your billing."
        } else if (statusCode === 403) {
          errorMessage = "Model not available. Your API key may not have access to this model."
        } else {
          errorMessage = `OpenAI API error: ${errorData.error?.message || "Unknown error"}`
        }

        return NextResponse.json({ error: errorMessage }, { status: statusCode })
      }

      const completionData = await completion.json()
      console.log("[v0] OpenAI response received successfully")

      const translatedText = completionData.choices[0]?.message?.content?.trim()

      if (!translatedText) {
        throw new Error("No translation received from OpenAI")
      }

      console.log("[v0] Translation completed successfully, length:", translatedText.length)

      return NextResponse.json({
        translatedText,
        originalText: text,
        fromLanguage: from,
        toLanguage: to,
      })
    } catch (openaiError) {
      console.error("[v0] OpenAI API error:", openaiError)

      let errorMessage = "OpenAI API error"

      if (openaiError instanceof Error) {
        errorMessage = `OpenAI API error: ${openaiError.message}`
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] Translation error details:", error)

    let errorMessage = "Translation failed. Please try again."

    if (error instanceof Error) {
      errorMessage = `Translation error: ${error.message}`
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
