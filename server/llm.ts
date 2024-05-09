import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { connect } from "vectordb";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

export class LlmService {
  constructor() {}

  async askForClassCode(
    classInfo: string,
    functionsListStr: string,
    question: string,
    dbOrm: string,
    dbUrl: string
  ): Promise<{ classCode: string; className: string }> {
    try {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

      if (!OPENAI_API_KEY) {
        throw new Error(
          "You need to provide an OpenAI API key. Go to https://platform.openai.com/account/api-keys to get one."
        );
      }

      const database = "./lancedb";

      const model = new OpenAI({
        // modelName: "gpt-3.5-turbo-0125",
        modelName: "gpt-4",
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0.6,
        verbose: true,
        // verbose:false
      });

      const db = await connect(database);
      const table = await db.openTable("vectors");

      console.log("Opened table");
      const vectorStore = new LanceDB(new OpenAIEmbeddings(), { table });
      const retriever = vectorStore.asRetriever(1);
      let prompt;
      if(dbOrm){
         prompt = ChatPromptTemplate.fromMessages([
          [
            "ai",
            `As an AI assistant for developers, you're tasked with writing a TypeScript class that implements a ${classInfo} and its functions: ${functionsListStr}.
          Utilize the ${dbOrm} ORM to connect to the database at ${dbUrl}. Remember to declare types for all variables and parameters, and never use "any" type. Implement the logic for the functions ${functionsListStr} directly within the class.
          Rely on the last point as the user's question. Feel free to use your knowledge, but avoid using comments.
          `
          ], [
            "human",
            `
          Your assignment is to create a ${classInfo} class in TypeScript, implementing the following functions: ${functionsListStr}. Follow these steps:
          1. Begin by defining a TypeScript class for ${classInfo}, starting with the line: \`export class <class_name>\`.

          2. Ensure that every variable and parameter within the class has a type annotation. Don't use define method.

          3. Use the ${dbOrm} ORM to connect to the specified database at ${dbUrl}. If necessary, define database models within the same file as your class.

          4. Incorporate any required npm packages to enhance your class's functionality. Avoid using external files.
          Never use "any" type and "useNewUrlParser: true, useUnifiedTopology: true" for the mongoose connection.

          5. Provide implementations for all specified methods, such as ${functionsListStr}. Don't use interfaces for input parameters, use primitive types.

          6. Format your source code within triple backticks (\`\`\`) when presenting it. Exclude any additional text outside the code.
  
          7. Always when you declare a class, always use the "export" keyword.
          
          8. Always when you declare a type, always use the "export" keyword.
          
          9. Always when you declare a variable outside the class, always use the "export" keyword.
          
          10. Never use "any" type and "useNewUrlParser: true, useUnifiedTopology: true" for the mongoose connection.
 
          11. For declare a model, this is the sintax "export const TaskModel = mongoose.models.Task || mongoose.model("Task", taskSchema);
                    
          12. For error handling just console.log the error. don't use "error.message" or "error.stack" because error is unknown.
          
          13. After you implement the class, implement outside the class a test function that will test the class.   
          
          14. Don't use "findByIdAndRemove" method from mongoose, instead use "findByIdAndDelete".
          
          15. ${question}`
          ]
        ]);
      }
      else{
        prompt = ChatPromptTemplate.fromMessages([
          [
            "ai",
            `As an AI assistant for developers, you're tasked with writing a TypeScript class that implements a ${classInfo} and its functions: ${functionsListStr}.
          Remember to declare types for all variables and parameters, and never use "any" type. Implement the logic for the functions ${functionsListStr} directly within the class.
          Rely on the last point as the user's question. Feel free to use your knowledge, but avoid using comments.
          `
          ], [
            "human",
            `
          Your assignment is to create a ${classInfo} class in TypeScript, implementing the following functions: ${functionsListStr}. Follow these steps:
          1. Begin by defining a TypeScript class for ${classInfo}, starting with the line: \`export class <class_name>\`.

          2. Ensure that every variable and parameter within the class has a type annotation. Don't use define method.

          3. Incorporate any required npm packages to enhance your class's functionality. Avoid using external files.
          Never use "any" type.

          4. Provide implementations for all specified methods, such as ${functionsListStr}. Don't use interfaces for input parameters, use primitive types.

          5. Format your source code within triple backticks (\`\`\`) when presenting it. Exclude any additional text outside the code.
  
          6. Always when you declare a class, always use the "export" keyword.
          
          7. Always when you declare a type, always use the "export" keyword.
          
          8. Always when you declare a variable outside the class, always use the "export" keyword.
            
          9. After you implement the class, implement outside the class a test function that will test the class.   
          
          10. all variables must have a type, and all functions must have a return type.
          
          11. For error handling just console.log the error. don't use "error.message" or "error.stack" because error is unknown.
         
              
          12. Be careful at eslint errors, don't ignore them. Always use the variables that you declare.
          
          13. ${question}`
          ]
        ]);
      }


      const outputParser = new StringOutputParser();

      const setupAndRetrieval = RunnableMap.from({
        context: new RunnableLambda({
          func: (input: string) =>
            retriever.invoke(input).then((response) => response[0].pageContent),
        }).withConfig({ runName: "contextRetriever" }),
        question: new RunnablePassthrough(),
      });

      const chain = setupAndRetrieval.pipe(prompt).pipe(model).pipe(outputParser);

      console.log("Ready to invoke");
      const response = await chain.invoke(prompt.toString());
      console.log("Invoked successfully");

      console.log("Answer:", response);

      let sourceCode = response.split("```")[1];
      const firstLine = sourceCode.split("\n")[0];
      if (!firstLine.startsWith("import")) {
        sourceCode = sourceCode.split("\n").slice(1).join("\n");
      }
      // Extract className from "class <class_name>"
      const className = sourceCode.split("class ")[1].split(" ")[0];

      console.log({ sourceCode, className });
      return {
        classCode: sourceCode,
        className: className,
      };
    } catch (error) {
      console.error("Error asking the AI: ", error);
      throw error;
    }
  }
}
