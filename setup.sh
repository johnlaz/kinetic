#!/bin/bash
# Kinetic Capital — Setup Script
# Downloads bundled JS libraries for offline PWA support
# Run once before deploying: bash setup.sh

echo "⚡ Kinetic Capital — Downloading JS libraries..."

# Chart.js 4.4.0
echo "📦 Downloading Chart.js..."
curl -sL "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" -o chart.umd.min.js
if [ $? -eq 0 ] && [ -s chart.umd.min.js ]; then
  echo "   ✓ chart.umd.min.js ($(wc -c < chart.umd.min.js | tr -d ' ') bytes)"
else
  echo "   ✗ Failed — trying npm..."
  npm pack chart.js@4.4.0 2>/dev/null && tar -xzf chart.js-4.4.0.tgz package/dist/chart.umd.min.js --strip-components=2 2>/dev/null
fi

# math.js 11.8.0
echo "📦 Downloading math.js..."
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.js" -o math.min.js
if [ $? -eq 0 ] && [ -s math.min.js ]; then
  echo "   ✓ math.min.js ($(wc -c < math.min.js | tr -d ' ') bytes)"
else
  echo "   ✗ Failed — trying npm..."
  npm pack mathjs@11.8.0 2>/dev/null
fi

# Verify
echo ""
echo "📋 File check:"
for f in index.html sw.js manifest.json icon-192.png chart.umd.min.js math.min.js; do
  if [ -f "$f" ]; then
    echo "   ✓ $f"
  else
    echo "   ✗ $f MISSING"
  fi
done

echo ""
echo "✅ Ready to deploy! See README.md for GitHub Pages instructions."
echo "🌐 Test locally: npx serve . then open http://localhost:3000"
