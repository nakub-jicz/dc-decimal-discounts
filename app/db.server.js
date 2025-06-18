import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

let prisma;

const getPrisma = (DATABASE_URL) => {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: DATABASE_URL,
    }).$extends(withAccelerate());
  }
  return prisma;
};

export default getPrisma;