Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param(
        [string]$Path,
        [int]$Width,
        [int]$Height
    )
    Write-Host "Resizing $Path to ${Width}x${Height}..."
    $src = [System.Drawing.Image]::FromFile($Path)
    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # High quality settings
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Draw and scale
    $g.DrawImage($src, 0, 0, $Width, $Height)
    
    $g.Dispose()
    $src.Dispose()
    
    # Save to a temporary file first to avoid locking issues, then replace
    $tempPath = $Path + ".tmp.png"
    $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    
    Move-Item -Path $tempPath -Destination $Path -Force
}

$baseDir = "c:\Users\enmel\Documents\Browser-Addons"
Resize-Image "$baseDir\icon128.png" 128 128
Resize-Image "$baseDir\icon48.png" 48 48
Resize-Image "$baseDir\icon16.png" 16 16
Write-Host "Done!"
