import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { requireRole } from '@/server/auth/guards'
import { z } from 'zod'

// GET /api/admin/users/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, 'ADMIN')
  if (!auth.ok) return auth.response
  const { id } = await params

  try {
    const user = await prisma.legacyUser.findUnique({
      where: { id },
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
        // exclude passwordHash, OTP fields to prevent exposing them
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

// PATCH /api/admin/users/[id]
const updateSchema = z.object({
  isActive: z.boolean().optional(),
  role:     z.enum(['BUYER', 'SELLER', 'ADMIN']).optional(),
  fullName: z.string().min(2).optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, 'ADMIN')
  if (!auth.ok) return auth.response
  const { id } = await params

  // prevent admin from modifying their own account via this route
  if (id === auth.user.userId) {
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
    const user = await prisma.legacyUser.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updated = await prisma.legacyUser.update({
      where: { id },
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

// DELETE /api/admin/users/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(req, 'ADMIN')
  if (!auth.ok) return auth.response
  const { id } = await params

  // prevent admin from deleting themselves
  if (id === auth.user.userId) {
    return NextResponse.json(
      { error: 'You cannot delete your own account' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.legacyUser.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // soft delete — anonymise personal data, keep the record
    await prisma.legacyUser.update({
      where: { id },
      data: {
        fullName:        'Deleted User',
        email:           `deleted_${id}@leads.pk`,
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