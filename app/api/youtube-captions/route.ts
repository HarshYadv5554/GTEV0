import { type NextRequest, NextResponse } from "next/server"

const SUPADATA_API_KEY = "sd_eccb89f4a13e6981feeccf2312001b8b"

function extractVideoId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/live\/([^&\n?#]+)/, // Handle live video URLs like /live/VIDEO_ID
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

async function getVideoTranscript(videoUrl: string) {
  try {
    console.log("[v0] Attempting to extract transcript using Supadata API for:", videoUrl)

    const response = await fetch(`https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}`, {
      method: "GET",
      headers: {
        "x-api-key": SUPADATA_API_KEY,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Supadata API error:", response.status, errorText)
      throw new Error(`Supadata API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[v0] Supadata API response received, processing...")

    if (data && data.content && Array.isArray(data.content)) {
      // Supadata returns: { lang: "pa", availableLangs: ["pa"], content: [{ text, duration, offset, lang }] }
      const formattedTranscript = data.content
        .map((item: any) => ({
          text: item.text || "",
          start: (item.offset || 0) / 1000, // Convert milliseconds to seconds
          duration: (item.duration || 1000) / 1000, // Convert milliseconds to seconds
        }))
        .filter((item: any) => item.text && item.text.trim().length > 0)

      console.log(`[v0] Successfully extracted ${formattedTranscript.length} transcript segments from Supadata`)
      return formattedTranscript
    } else if (data && data.transcript) {
      // Fallback for other possible formats
      const transcript = Array.isArray(data.transcript) ? data.transcript : [data.transcript]

      const formattedTranscript = transcript
        .map((item: any, index: number) => ({
          text: typeof item === "string" ? item : item.text || item.content || "",
          start: item.start || index,
          duration: item.duration || 1,
        }))
        .filter((item: any) => item.text && item.text.trim().length > 0)

      console.log(`[v0] Successfully extracted ${formattedTranscript.length} transcript segments`)
      return formattedTranscript
    } else if (typeof data === "string") {
      // Handle case where transcript is returned as a single string
      const segments = data.split(/[.!?]+/).filter((s) => s.trim().length > 0)
      const formattedTranscript = segments.map((text: string, index: number) => ({
        text: text.trim(),
        start: index,
        duration: 1,
      }))

      console.log(`[v0] Successfully processed string transcript into ${formattedTranscript.length} segments`)
      return formattedTranscript
    } else {
      console.error("[v0] Unexpected Supadata response format:", JSON.stringify(data, null, 2))
      throw new Error("Unexpected response format from Supadata API")
    }
  } catch (error) {
    console.error("[v0] Supadata transcript extraction error:", error)
    throw new Error(
      `Failed to extract captions: ${error instanceof Error ? error.message : "Unknown error"}. Please ensure the video has captions available.`,
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get("videoId")

  console.log("[v0] Fetching captions for video ID:", videoId)

  if (!videoId) {
    return NextResponse.json({ error: "Video ID is required" }, { status: 400 })
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const transcript = await getVideoTranscript(videoUrl)
    console.log("[v0] Successfully extracted transcript, segments:", transcript.length)
    return NextResponse.json(transcript)
  } catch (error) {
    console.error("[v0] Caption extraction error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch video captions",
      },
      { status: 500 },
    )
  }
}
