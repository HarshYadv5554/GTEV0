import { type NextRequest, NextResponse } from "next/server"

function chunkText(text: string, maxChunkSize = 3000): string[] {
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
    console.log("[v0] Translation API called")

    const { text, from, to } = await request.json()

    console.log("[v0] Translation request received, text length:", text?.length)
    console.log("[v0] From:", from, "To:", to)

    if (!text || !from || !to) {
      console.log("[v0] Missing required parameters")
      return NextResponse.json({ error: "Text, from, and to parameters are required" }, { status: 400 })
    }

    const isLongText = text.length > 4000
    console.log("[v0] Text is long:", isLongText, "- will use chunking if needed")

    const apiKey =
      process.env.OPENAI_API_KEY ||
      "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"

    if (!apiKey || apiKey === "your-openai-api-key-here") {
      console.log("[v0] Invalid or missing OpenAI API key")
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    console.log("[v0] Using API key:", apiKey.substring(0, 20) + "...")

    console.log("[v0] Testing OpenAI API key with direct fetch...")
    try {
      const testResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 5,
        }),
      })

      if (!testResponse.ok) {
        const errorData = await testResponse.json()
        console.error("[v0] API key test failed:", errorData)
        return NextResponse.json(
          {
            error: `OpenAI API key test failed: ${errorData.error?.message || "Unknown error"}`,
          },
          { status: testResponse.status },
        )
      }

      console.log("[v0] API key test successful")
    } catch (testError) {
      console.error("[v0] API key test failed:", testError)
      return NextResponse.json(
        {
          error: `OpenAI API connection failed: ${testError instanceof Error ? testError.message : "Unknown error"}`,
        },
        { status: 500 },
      )
    }

    if (isLongText) {
      console.log("[v0] Processing long text with chunking...")
      const chunks = chunkText(text, 3000)
      console.log("[v0] Split text into", chunks.length, "chunks")

      const translatedChunks: string[] = []

      for (let i = 0; i < chunks.length; i++) {
        console.log(`[v0] Translating chunk ${i + 1}/${chunks.length}, length: ${chunks[i].length}`)

        const prompt = `You are translating Gurmukhi (Punjabi script) text to English. This is part ${i + 1} of ${chunks.length} from a YouTube video transcript. Please provide a natural, accurate English translation that maintains the original meaning and context.

Text to translate:
${chunks[i]}`

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
              max_tokens: 4000,
              temperature: 0.3,
            }),
          })

          if (!completion.ok) {
            const errorData = await completion.json()
            console.error(`[v0] OpenAI API error for chunk ${i + 1}:`, errorData)
            throw new Error(`Translation failed for chunk ${i + 1}: ${errorData.error?.message || "Unknown error"}`)
          }

          const completionData = await completion.json()
          const translatedChunk = completionData.choices[0]?.message?.content?.trim()

          if (!translatedChunk) {
            throw new Error(`No translation received for chunk ${i + 1}`)
          }

          translatedChunks.push(translatedChunk)
          console.log(`[v0] Chunk ${i + 1} translated successfully, length: ${translatedChunk.length}`)

          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        } catch (chunkError) {
          console.error(`[v0] Error translating chunk ${i + 1}:`, chunkError)
          throw new Error(
            `Failed to translate chunk ${i + 1}: ${chunkError instanceof Error ? chunkError.message : "Unknown error"}`,
          )
        }
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

    const prompt = `You are translating Gurmukhi (Punjabi script) text to English. The text is from a YouTube video transcript. Please provide a natural, accurate English translation that maintains the original meaning and context.

Text to translate:
${text}`

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
          max_tokens: 4000,
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
        console.log("[v0] No translation received from OpenAI")
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
        console.log("[v0] OpenAI error message:", openaiError.message)
        errorMessage = `OpenAI API error: ${openaiError.message}`
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    console.error("[v0] Translation error details:", error)

    let errorMessage = "Translation failed. Please try again."

    if (error instanceof Error) {
      console.log("[v0] Error message:", error.message)
      errorMessage = `Translation error: ${error.message}`
    }

    console.log("[v0] Returning error response:", errorMessage)

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
