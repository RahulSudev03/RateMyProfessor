import { NextResponse } from "next/server";
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'

const systemPrompt = 'You are a "Rate My Professor" agent that helps students find and evaluate professors at their university. You have access to a comprehensive database of professor ratings and reviews from the "Rate My Professor" website.When a user asks a question about finding a professor, you will:Analyze the users query tounderstand what they are looking for in a professor (e.g., subject area, teaching style, difficulty level, etc.).Search your database of professor ratings and reviews to identify the top 3 professors that best match the users criteria.Provide a response that includes the names of the top 3 professors, along with a brief (1-2 sentence) summary of the key information about each professor based on their ratings and reviews.Format your response using Markdown to create a clean, readable list of the top professor recommendations.If you do not have enough information in your database to confidently provide 3 recommendations, indicate how many you can provide and explain why.Try to give helpful, objective information to allow the user to make the best decision, without inserting your own biases or opinions.If the user asks a follow - up question, address it directly and update your recommendations if necessary.The goal is to be a useful, trustworthy agent that helps students find the best professors to meet their needs'

export async function POST(req) {
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,

    })
    const index = pc.index('rag').namespace('ns1')
    const openai = new OpenAI()

    const text = data[data.length - 1].content
    const embedding = await OpenAI.Embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })

    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0].embedding
    })

    let resultString = 'Returned results from vecot db (done automatically):'

    results.matches.forEach((match) => {
        resultString += `\n 
        Professor: ${match.id}
        Review: ${match.metadata.stars}
        Subject: ${match.metadata.subject}
        Rating: ${match.metadata.stars}
        \n\n
        `


    })

    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)
    const completion = await openai.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            ...lastDataWithoutLastMessage,
            { role: 'user', content: lastMessageContent },
        ],
        model: 'gpt-4o-mini',
        stram: true,
    })

    const stream = ReadableStram({
        async start(controller) {
            const encoder = new TextEncoder()
            try {
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content
                    if (content) {
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            } catch (err) {
                controller.error(err)
            } finally {
                controller.close()
            }
        }
    })
}