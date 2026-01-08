// Backend server entrypoint
import app from './hono';
import { readFileSync } from 'fs';
import { join } from 'path';

// Explicitly load .env file
const envPath = join(process.cwd(), '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        // Get everything after the first = (in case value contains =)
        let value = trimmed.substring(equalIndex + 1);
        // Remove leading/trailing whitespace and any carriage returns
        value = value.trim().replace(/\r$/, '');
        // Remove surrounding quotes if present (handle both single and double quotes)
        let cleanValue = value;
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          cleanValue = value.slice(1, -1);
        }
        if (key && cleanValue) {
          // Force set the env var (Bun might have its own .env loading)
          process.env[key] = cleanValue;
          // Verify it was set correctly
          const verify = process.env[key];
          if (verify && verify.length !== cleanValue.length) {
            console.error(`   ⚠️  Key ${key} length mismatch! Set ${cleanValue.length}, read ${verify.length}`);
          }
          // Debug: log key length for API keys
          if (key.includes('API_KEY')) {
            console.log(`   Loaded ${key}: ${cleanValue.length} chars → process.env has ${verify?.length || 0} chars`);
          }
        }
      }
    }
  });
  console.log('✅ Loaded .env file');
} catch (error) {
  console.warn('⚠️  Could not load .env file:', error);
}

const port = process.env.PORT || 3000;
const hostname = process.env.HOST || '0.0.0.0';

console.log(`🚀 Backend server running on http://${hostname}:${port}`);
const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const kieKey = process.env.KIE_API_KEY;
console.log(`📝 API keys loaded: ${claudeKey ? 'Claude ✓' : 'Claude ✗'} ${openaiKey ? 'OpenAI ✓' : 'OpenAI ✗'} ${kieKey ? 'Kie ✓' : 'Kie ✗'}`);
if (claudeKey) {
  console.log(`   Claude key: ${claudeKey.substring(0, 20)}... (length: ${claudeKey.length})`);
  if (claudeKey.length < 50) {
    console.error(`   ⚠️  WARNING: Key seems truncated! Expected ~100+ chars`);
  }
}
if (kieKey) {
  console.log(`   Kie key: ${kieKey.substring(0, 10)}... (length: ${kieKey.length})`);
}

// Use Bun if available, otherwise fallback to Node
if (typeof Bun !== 'undefined') {
  Bun.serve({
    fetch: app.fetch,
    port: Number(port),
    hostname: hostname,
  });
  console.log(`✅ Server started with Bun on ${hostname}:${port}`);
} else {
  // Fallback to Node.js
  try {
    const { serve } = require('@hono/node-server');
    serve({
      fetch: app.fetch,
      port: Number(port),
      hostname: hostname,
    });
    console.log(`✅ Server started with Node.js on ${hostname}:${port}`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Install @hono/node-server: npm install @hono/node-server');
    process.exit(1);
  }
}

