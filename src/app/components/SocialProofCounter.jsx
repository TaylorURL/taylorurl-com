import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { fadeInUp } from '@constants/animations'

const BASE_COUNT = 47
const INCREMENT_INTERVAL_MS = 45000

export default function SocialProofCounter() {
  const [count, setCount] = useState(BASE_COUNT)

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(prev => prev + 1)
    }, INCREMENT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <motion.div
      {...fadeInUp}
      className="flex items-center justify-center gap-3 border-t border-gray-200 bg-blue-50 py-4"
    >
      <Users className="h-4 w-4 text-blue-600" />
      <p className="text-sm text-gray-600">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block font-bold text-blue-600"
        >
          {count}
        </motion.span>{' '}
        local businesses served this year
      </p>
    </motion.div>
  )
}
