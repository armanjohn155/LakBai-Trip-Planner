<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $recap['title'] }} · Lakbai</title>

    <meta name="description" content="{{ \Illuminate\Support\Str::limit((string) ($recap['summary'] ?? 'A finished Lakbai trip recap.'), 160) }}">
    <link rel="canonical" href="{{ $publicUrl }}">

    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Lakbai">
    <meta property="og:title" content="{{ $recap['title'] }}">
    <meta property="og:description" content="{{ \Illuminate\Support\Str::limit((string) ($recap['summary'] ?? 'A finished Lakbai trip recap.'), 200) }}">
    <meta property="og:url" content="{{ $publicUrl }}">
    @if (! empty($recap['cover_photo']['url']))
        <meta property="og:image" content="{{ $recap['cover_photo']['url'] }}">
        <meta name="twitter:image" content="{{ $recap['cover_photo']['url'] }}">
    @endif

    <meta name="twitter:card" content="{{ empty($recap['cover_photo']['url']) ? 'summary' : 'summary_large_image' }}">
    <meta name="twitter:title" content="{{ $recap['title'] }}">
    <meta name="twitter:description" content="{{ \Illuminate\Support\Str::limit((string) ($recap['summary'] ?? 'A finished Lakbai trip recap.'), 200) }}">

    <meta http-equiv="refresh" content="0;url={{ $appUrl }}">
    <style>
        body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f6f3ea; color: #12232b; }
        main { max-width: 640px; margin: 12vh auto; padding: 28px; background: #fff; border-radius: 18px; box-shadow: 0 18px 50px rgba(3, 33, 31, .12); }
        p { line-height: 1.6; }
        a { color: #0b6e99; }
    </style>
</head>
<body>
    <main>
        <p><strong>{{ $recap['title'] }}</strong></p>
        <p>{{ $recap['summary'] ?: 'A finished Lakbai trip recap.' }}</p>
        <p>Opening the interactive recap&hellip; <a href="{{ $appUrl }}">Continue to the recap</a>.</p>
    </main>

    <script>
        window.location.replace(@json($appUrl));
    </script>
</body>
</html>
