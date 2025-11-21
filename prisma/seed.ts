import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("seeding database...");//wanted to see if seeding works 

  const user = await prisma.user.upsert({
    where: { email: "test@scribeai.com" },
    update: {},
    create: {
      email: "test@scribeai.com",
    },
  });

  console.log("✅ Created test user:", user);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      title: "Sample Meeting - Product Roadmap Discussion",
      status: "completed",
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
      endedAt: new Date(),
      transcript: "This is a sample transcript of a meeting discussing product roadmap priorities.",
      summaryJSON: {
        summary: "Team discussed Q1 product priorities and resource allocation.",
        keyPoints: [
          "Focus on user authentication features",
          "Improve real-time transcription accuracy",
          "Add multi-language support",
        ],
        actionItems: [
          "John to research transcription APIs",
          "Sarah to create UI mockups",
          "Deploy beta by end of month",
        ],
        decisions: ["Prioritize authentication over analytics", "Use Gemini API for transcription"],
      },
    },
  });

  console.log("sample session:", session);

  for (let i = 0; i < 3; i++) {
    await prisma.transcriptChunk.create({
      data: {
        sessionId: session.id,
        seq: i,
        audioPath: `./storage/audio-chunks/${session.id}/${i}-sample.webm`,
        durationMs: 30000,
        text: `Sample transcript chunk ${i + 1}`,
        speaker: i % 2 === 0 ? "Speaker A" : "Speaker B",
        confidence: 0.95,
        status: "transcribed",
      },
    });
  }

  console.log("Created sample transcript chunks");
  console.log("\nSeeding completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seeding error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
