'use client'

import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'

export default function ProfileIndex() {
  const { address } = useAccount()
  const router = useRouter()

  useEffect(() => {
    if (address) router.replace(`/profile/${address}`)
  }, [address, router])

  return (
    <div className="page-scroll">
      <div className="empty-state">Connect wallet to view your profile</div>
    </div>
  )
}
