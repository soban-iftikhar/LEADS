import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'

// ── Auth helper ───────────────────────────────────────────────────────────────
function getAdminFromRequest(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) return null
  try {
    const payload = verifyToken(token)
    if (payload.role !== 'ADMIN') return null
    return payload
  } catch {
    return null
  }
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const admin = getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)

  // pagination
  const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'))
  const skip  = (page - 1) * limit

  // sorting — whitelist allowed fields to prevent injection
  const allowedSortFields = ['createdAt', 'fullName', 'email', 'role']
  const sortBy = allowedSortFields.includes(searchParams.get('sortBy') || '')
    ? searchParams.get('sortBy')!
    : 'createdAt'
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

  // filters
  const role     = searchParams.get('role')     || undefined
  const search   = searchParams.get('search')   || undefined
  const isActive = searchParams.get('isActive') || undefined

  // dynamic where clause
  const where: Record<string, unknown> = {}

  if (role && ['BUYER', 'SELLER', 'ADMIN'].includes(role)) {
    where.role = role
  }

  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true'
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email:    { contains: search, mode: 'insensitive' } },
      { phone:    { contains: search, mode: 'insensitive' } },
    ]
  }

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip,
        take: limit,
        select: {
          id:              true,
          fullName:        true,
          email:           true,
          phone:           true,
          role:            true,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive:        true,
          createdAt:       true,
          updatedAt:       true,
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/users]', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}