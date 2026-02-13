Add-Type -AssemblyName System.Drawing

$colors = @(
    @{hex = 0xFF667eea; file = 'stream-1.jpg'},
    @{hex = 0xFF764ba2; file = 'stream-2.jpg'},
    @{hex = 0xFFf093fb; file = 'stream-3.jpg'},
    @{hex = 0xFF4facfe; file = 'stream-4.jpg'},
    @{hex = 0xFF00f2fe; file = 'stream-5.jpg'},
    @{hex = 0xFF43e97b; file = 'stream-6.jpg'},
    @{hex = 0xFFa8edea; file = 'stream-7.jpg'},
    @{hex = 0xFFfed6e3; file = 'stream-8.jpg'},
    @{hex = 0xFFc471f5; file = 'stream-9.jpg'}
)

$imagePath = 'C:\Users\SKAX\IdeaProjects\uta_ui\public\images'

foreach ($item in $colors) {
    $bitmap = New-Object System.Drawing.Bitmap(400, 225)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $color = [System.Drawing.Color]::FromArgb($item.hex)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $graphics.FillRectangle($brush, 0, 0, 400, 225)

    $font = New-Object System.Drawing.Font('Arial', 20, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.DrawString('Stream Thumbnail', $font, $textBrush, 50, 90)

    $graphics.Dispose()
    $brush.Dispose()

    $filePath = Join-Path $imagePath $item.file
    $bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bitmap.Dispose()

    Write-Host "Created: $filePath"
}

Write-Host "All images created successfully!"

