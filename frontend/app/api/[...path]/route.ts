import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getBackendBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:8000'

  const v = String(raw || '').trim().replace(/\/+$/, '')
  if (!v) return 'http://localhost:8000'
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  return `https://${v}`
}

function filterRequestHeaders(req: NextRequest) {
  const headers = new Headers()

  // Only forward headers we actually need. Avoid hop-by-hop headers.
  const allowList = [
    'accept',
    'content-type',
    'authorization',
    'x-csrf-token',
    'x-beta-key',
  ]

  for (const key of allowList) {
    const v = req.headers.get(key)
    if (v) headers.set(key, v)
  }

  // Forward cookies for auth flows if any exist
  const cookie = req.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  return headers
}

async function handler(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = new URL(req.url)
  const target = `${backend}${url.pathname}${url.search}`

  const method = req.method.toUpperCase()
  const headers = filterRequestHeaders(req)

  const init: RequestInit = {
    method,
    headers,
    redirect: 'manual',
  }

  if (!['GET', 'HEAD'].includes(method)) {
    init.body = await req.text()
  }

  const upstream = await fetch(target, init)

  // Pass through response body + status + key headers
  const resHeaders = new Headers()
  const passHeaders = ['content-type', 'set-cookie', 'cache-control']
  for (const h of passHeaders) {
    const v = upstream.headers.get(h)
    if (v) resHeaders.set(h, v)
  }

  const body = await upstream.arrayBuffer()
  return new NextResponse(body, { status: upstream.status, headers: resHeaders })
}

export async function GET(req: NextRequest) {
  return handler(req)
}
export async function POST(req: NextRequest) {
  return handler(req)
}
export async function PUT(req: NextRequest) {
  return handler(req)
}
export async function PATCH(req: NextRequest) {
  return handler(req)
}
export async function DELETE(req: NextRequest) {
  return handler(req)
}
export async function OPTIONS(req: NextRequest) {
  return handler(req)
}


