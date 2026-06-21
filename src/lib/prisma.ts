import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../../generated/prisma/client";

const adapter = new PrismaMariaDb(
	{
		host: process.env.MYSQL_HOST!,
		user: process.env.MYSQL_USER!,
		password: process.env.MYSQL_PASSWORD!,
		connectionLimit: 5,
	},
	{
		database: process.env.MYSQL_NAME!,
	},
);

export const prisma = new PrismaClient({
	adapter,
});
