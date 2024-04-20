import {GenezioDeploy} from "@genezio/types";
import {LanceDB} from "@langchain/community/vectorstores/lancedb";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {OpenAI, OpenAIEmbeddings} from "@langchain/openai";
import {connect} from "vectordb";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import {StringOutputParser} from "@langchain/core/output_parsers";

@GenezioDeploy()
export class LlmService {
  constructor() {
  }

  async ask(classInfo: string, functionsListStr: string, question: string, dbOrm: string, dbUrl: string): Promise<{
    classCode: string,
    className: string
  }> {
    try {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

      if (!OPENAI_API_KEY) {
        throw new Error("You need to provide an OpenAI API key. Go to https://platform.openai.com/account/api-keys to get one.");
      }

      const database = "./lancedb";

      const model = new OpenAI({
        modelName: "gpt-3.5-turbo-0125",
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0.5,
        verbose: true
      });

      const db = await connect(database);
      const table = await db.openTable('vectors')

      console.log("Opened table")
      const vectorStore = new LanceDB(new OpenAIEmbeddings, {table})
      const retriever = vectorStore.asRetriever(1);

      const prompt = ChatPromptTemplate.fromMessages([
        [
          "ai",
          `You are a an AI assistant that helps developers write code. You have been asked to help a developer write a ${classInfo} class in TypeScript that implements the following functions: ${functionsListStr}.
         Always rely on the last point because that is actually the user's question. If necesarry, also use your khnowledge. Never use comments.`
        ], [
          "human",
          `
Your task is to write a ${classInfo} class in TypeScript that implements the following functions: ${functionsListStr} by following the next steps:

1. Write a TypeScript backend class that implements a ${classInfo}. Begin the class declaration must use @GenezioDeploy() decorator from @genezio/types, and declare class by following line \`export class <class_name>\`.

2. Within the class, ensure that you utilize type annotations for every variable and parameter.

3. Utilize the ${dbOrm} ORM to establish a connection to a database. Connect to the database using the following URL: ${dbUrl}. Create the models for the database as needed in the same file as your class.

4. Use any necessary npmjs packages for your implementation. Feel free to leverage these packages as needed to enhance the functionality of your class. Never use any external files.

5. Your class should include specific methods such as ${functionsListStr}. Ensure that you provide the implementation for each of these methods.

6. When presenting your source code, make sure to format it within triple backticks \`\`\`. This formatting helps maintain clarity and readability. Include only the source code itself within the triple backticks, without adding any additional text.

7. Check the code for any errors or bugs. Make sure that the code is clean and follows best practices. 

8. If you use database, make sure to init the database tables at the top.

9. Don't create initializer example or usage example. Just the class code.

10. Use all variable that you declared or remove them because eslint will throw an error.

11. Always implement logic methods.

12. For model database init them at the top of the class and outside the class.

13. Never use comments always implement logic methods.

14. At method declaration always use async keyword.

15. ${question}`

        ]
      ]);

      const outputParser = new StringOutputParser();

      const setupAndRetrieval = RunnableMap.from({
        context: new RunnableLambda({
          func: (input: string) =>
            retriever.invoke(input).then((response) => response[0].pageContent),
        }).withConfig({runName: "contextRetriever"}),
        question: new RunnablePassthrough(),
      });

      const chain = setupAndRetrieval.pipe(prompt).pipe(model).pipe(outputParser)

      console.log("Ready to invoke")
      const response = await chain.invoke(prompt.toString());
      console.log("Invoked successfully")

      console.log("Answer:", response)

      let sourceCode = response.split("```")[1];
      const firstLine = sourceCode.split("\n")[0];
      if (!firstLine.startsWith("import")) {
        sourceCode = sourceCode.split("\n").slice(1).join("\n");
      }
      // get className from export class <class_name>
      const className = sourceCode.split("export class ")[1].split(" ")[0];


      console.log({sourceCode, className});
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
