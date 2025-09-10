"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Download, Copy, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TranslationResult {
  originalText: string
  translatedText: string
  timestamp: string
}

export default function GurmukhiTranslator() {
  const [videoUrl, setVideoUrl] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [translationResults, setTranslationResults] = useState<TranslationResult[]>([])
  const [currentStatus, setCurrentStatus] = useState("")
  const { toast } = useToast()

  const extractVideoId = (url: string) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/, // Handle live video URLs
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }

    return null
  }

  const fetchCaptions = async (videoId: string) => {
    try {
      const response = await fetch(`/api/youtube-captions?videoId=${videoId}`)
      if (!response.ok) throw new Error("Failed to fetch captions")
      return await response.json()
    } catch (error) {
      throw new Error("Could not retrieve video captions")
    }
  }

  const translateText = async (text: string) => {
    try {
      console.log("[v0] Calling translation API...")
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, from: "gurmukhi", to: "english" }),
      })

      console.log("[v0] Translation API response status:", response.status)

      if (!response.ok) {
        const responseClone = response.clone()
        let errorMessage = "Translation failed"

        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (jsonError) {
          // If response is not JSON, get text content from cloned response
          try {
            const errorText = await responseClone.text()
            console.log("[v0] Non-JSON error response:", errorText)
            errorMessage = `Server error: ${response.status} - ${errorText.substring(0, 100)}`
          } catch (textError) {
            console.log("[v0] Could not read error response")
            errorMessage = `Server error: ${response.status}`
          }
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log("[v0] Translation successful")
      return result
    } catch (error) {
      console.error("[v0] Translation error:", error)
      throw new Error(error instanceof Error ? error.message : "Translation service unavailable")
    }
  }

  const handleTranslate = async () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid YouTube URL",
        variant: "destructive",
      })
      return
    }

    const videoId = extractVideoId(videoUrl)
    if (!videoId) {
      toast({
        title: "Error",
        description: "Invalid YouTube URL format",
        variant: "destructive",
      })
      return
    }

    setIsTranslating(true)
    setProgress(0)
    setTranslationResults([])
    setCurrentStatus("Fetching video captions...")

    try {
      console.log("[v0] Starting translation for video:", videoId)

      setProgress(20)
      const captionsResponse = await fetch(`/api/youtube-captions?videoId=${videoId}`)

      if (!captionsResponse.ok) {
        const errorData = await captionsResponse.json()
        throw new Error(errorData.error || "Failed to fetch captions")
      }

      const captions = await captionsResponse.json()
      console.log("[v0] Captions fetched:", captions.length, "segments")

      setCurrentStatus("Processing captions for translation...")
      setProgress(40)

      const fullText = captions.map((caption: any) => caption.text).join(" ")

      if (!fullText.trim()) {
        throw new Error("No caption text found in the video")
      }

      console.log("[v0] Full text length:", fullText.length)

      setCurrentStatus("Translating content with AI...")
      setProgress(60)

      const translation = await translateText(fullText)

      setProgress(80)
      setCurrentStatus("Finalizing translation...")

      const result: TranslationResult = {
        originalText: fullText,
        translatedText: translation.translatedText,
        timestamp: new Date().toLocaleString(),
      }

      setTranslationResults([result])
      setProgress(100)
      setCurrentStatus("Translation complete!")

      console.log("[v0] Translation completed successfully")

      toast({
        title: "Success",
        description: "Video translation completed successfully!",
      })
    } catch (error) {
      console.error("[v0] Translation process error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Translation failed",
        variant: "destructive",
      })
    } finally {
      setIsTranslating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Translation copied to clipboard",
    })
  }

  const downloadTranslation = () => {
    if (translationResults.length === 0) return

    const content = translationResults[0].translatedText
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "gurmukhi-translation.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Gurmukhi to English Translator</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Translate YouTube videos from Gurmukhi to English using advanced AI. Simply paste a YouTube URL and get the
            complete translation.
          </p>
        </div>

        {/* Input Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Video Input
            </CardTitle>
            <CardDescription>Enter the YouTube video URL you want to translate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="flex-1"
                disabled={isTranslating}
              />
              <Button onClick={handleTranslate} disabled={isTranslating || !videoUrl.trim()} className="px-8">
                {isTranslating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Translating
                  </>
                ) : (
                  "Translate Video"
                )}
              </Button>
            </div>

            {/* Progress Section */}
            {isTranslating && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{currentStatus}</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {translationResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Translation Results
                  </CardTitle>
                  <CardDescription>Complete translation of the video content</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(translationResults[0].translatedText)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadTranslation}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {translationResults.map((result, index) => (
                <div key={index} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Translated on {result.timestamp}</Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-2 text-foreground">Original (Gurmukhi)</h3>
                      <Textarea value={result.originalText} readOnly className="min-h-[300px] resize-none bg-muted" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2 text-foreground">Translation (English)</h3>
                      <Textarea value={result.translatedText} readOnly className="min-h-[300px] resize-none bg-card" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary-foreground font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Extract Captions</h4>
                <p className="text-muted-foreground">We fetch the video captions using YouTube's API</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary-foreground font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">AI Translation</h4>
                <p className="text-muted-foreground">Advanced AI translates Gurmukhi text to English</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary-foreground font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Complete Results</h4>
                <p className="text-muted-foreground">Get the full translation in one comprehensive result</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
