import {GenezioDeploy} from "@genezio/types";
import {LlmService} from "./llm";
import {execSync} from "node:child_process";
import * as fs from "fs";
import path from "path";

@GenezioDeploy()
export class BackendService {
  llmService: LlmService;

  constructor() {
    this.llmService = new LlmService();
  }

  async createTheProject(classInfo: string, functionsListStr: string, question: string, dbOrm: string, dbUrl: string) {
    try {
      const {classCode, className} = await this.llmService.ask(classInfo, functionsListStr, question, dbOrm, dbUrl);
      const tmpDirPath = path.join(process.cwd(), "tmp");

      if (!fs.existsSync(tmpDirPath)) {
        fs.mkdirSync(tmpDirPath);
      }

      const command = `genezio create backend --backend=onboarding-ts --name=${classInfo} --region=eu-central-1`;
      console.log("Running command: ", command);
      execSync(command, {cwd: tmpDirPath});
      const pathFolder = path.join(tmpDirPath, classInfo);
      fs.writeFileSync(
        `${pathFolder}/${className}.ts`,
        classCode
      )

      while (!fs.existsSync(`${pathFolder}/${className}.ts`)) {
        console.log("Waiting for file to be created...", `${pathFolder}/${className}.ts`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const imports = classCode.match(/import.*?;/g);
      const regexPackage = /['"]([^'"]*)['"]/;

      const importsSave= [];
      if (imports) {
        for (const imp of imports) {
          const importName = imp.match(regexPackage)![1];
          importsSave.push(importName);
          execSync(`npm install ${importName}`, {cwd: pathFolder});
        }
      }

      if(importsSave.includes("sequelize")) {
        execSync(`npm install pg`, {cwd: pathFolder});
        execSync(`npm install pg-hstore`, {cwd: pathFolder});
      }

      return 0;
    } catch (error) {
      console.error(error)
      throw error;
    }
  }
}
