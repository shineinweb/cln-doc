import { prisma } from '../src/db'
import { loadEnv } from '../src/env'
import { seedReference } from '../src/seed'

const env = loadEnv()
await seedReference(prisma, env)
await prisma.$disconnect()
