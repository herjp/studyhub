import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function POST() {
  try {
    const nodeBin = "/Users/jonahhermansa/.nodejs/bin";
    const env = { ...process.env, PATH: `${nodeBin}:${process.env.PATH}` };

    await execPromise("npx tsx prisma/seed.ts", { env });
    return NextResponse.json({ success: true, message: "Demodaten erfolgreich neu geladen!" });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Demodaten", details: error.message },
      { status: 500 }
    );
  }
}
