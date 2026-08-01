import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'
import { z } from 'zod'

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

// ── GET /api/admin/users/[id] ─────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
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
        // exclude passwordHash, OTP fields — never expose these
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[GET /api/admin/users/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// ── PATCH /api/admin/users/[id] ───────────────────────────────────────────────
const updateSchema = z.object({
  isActive: z.boolean().optional(),
  role:     z.enum(['BUYER', 'SELLER', 'ADMIN']).optional(),
  fullName: z.string().min(2).optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // prevent admin from modifying their own account via this route
  if (params.id === admin.userId) {
    return NextResponse.json(
      { error: 'You cannot modify your own account through this endpoint' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // nothing to update
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: 'No fields provided to update' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data:  parsed.data,
      select: {
        id:       true,
        fullName: true,
        email:    true,
        role:     true,
        isActive: true,
        updatedAt:true,
      },
    })

    return NextResponse.json({
      message: 'User updated successfully',
      data:    updated,
    })
  } catch (error) {
    console.error('[PATCH /api/admin/users/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// ── DELETE /api/admin/users/[id] ──────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // prevent admin from deleting themselves
  if (params.id === admin.userId) {
    return NextResponse.json(
      { error: 'You cannot delete your own account' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // soft delete — anonymise personal data, keep the record
    await prisma.user.update({
      where: { id: params.id },
      data: {
        fullName:        'Deleted User',
        email:           `deleted_${params.id}@leads.pk`,
        phone:           null,
        passwordHash:    'DELETED',
        isActive:        false,
        emailOtpHash:    null,
        phoneOtpHash:    null,
        emailOtpExpiresAt: null,
        phoneOtpExpiresAt: null,
      },
    })

    return NextResponse.json({
      message: 'User account has been permanently deleted and data anonymised',
    })
  } catch (error) {
    console.error('[DELETE /api/admin/users/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}