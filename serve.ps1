# MERIT FEST - Local static dev server (no Node/Python required)
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 5173]
param([int]$Port = 5173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "MERIT FEST dev server running at http://localhost:$Port/  (Ctrl+C to stop)"

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8";
  ".js" = "application/javascript; charset=utf-8"; ".json" = "application/json; charset=utf-8";
  ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".png" = "image/png"; ".svg" = "image/svg+xml";
  ".webp" = "image/webp"; ".ico" = "image/x-icon"; ".glb" = "model/gltf-binary"; ".md" = "text/plain; charset=utf-8"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
      if ($path -eq "/") { $path = "/index.html" }
      $file = Join-Path $root ($path.TrimStart("/") -replace "/", "\")
      $full = [System.IO.Path]::GetFullPath($file)
      if (-not $full.StartsWith($root) -or -not (Test-Path $full -PathType Leaf)) {
        $full = Join-Path $root "index.html"   # SPA fallback
      }
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $res.Headers.Add("Cache-Control", "no-cache")
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
