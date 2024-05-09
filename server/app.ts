import {LlmService} from "./llm";
import {execSync} from "node:child_process";
import * as fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export class BackendService {
  llmService: LlmService;

  constructor() {
    this.llmService = new LlmService();
  }

  async createTheProject(classInfo: string, functionsListStr: string, question: string, dbOrm: string, dbUrl: string) {
    try {
      const {
        classCode,
        className
      } = await this.llmService.askForClassCode(classInfo, functionsListStr, question, dbOrm, dbUrl);
      const tmpDirPath = path.join(process.cwd(), "tmp");

      if (!fs.existsSync(tmpDirPath)) {
        fs.mkdirSync(tmpDirPath);
      }

      const command = `genezio create backend --backend=onboarding-ts --name=${classInfo} --region=eu-central-1`;
      console.log("Creating the project...");
      execSync(command, {cwd: tmpDirPath});
      const pathFolder = path.join(tmpDirPath, classInfo);
      fs.writeFileSync(
        `${pathFolder}/${className}.ts`,
        classCode
      )
      fs.unlinkSync(`${pathFolder}/genezio.yaml`);
      fs.unlinkSync(`${pathFolder}/.genezioignore`);
      fs.unlinkSync(`${pathFolder}/.eslintrc.js`);
      fs.rm(`${pathFolder}/node_modules/@genezio`, {recursive: true}, (err) => {
        if (err) {
          console.error(err);
        }
      });
      const packageJson = JSON.parse(fs.readFileSync(`${
        pathFolder
      }/package.json`, "utf8"));
      delete packageJson.dependencies["@genezio/types"];
      fs.writeFileSync(
        `${pathFolder}/package.json`,
        JSON.stringify(packageJson, null, 2)
      );
      while (!fs.existsSync(`${pathFolder}/${className}.ts`)) {
        console.log("Waiting for file to be created...", `${pathFolder}/${className}.ts`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const imports = classCode.match(/import.*?;/g);
      const regexPackage = /['"]([^'"]*)['"]/;

      const importsSave = [];
      if (imports) {
        for (const imp of imports) {
          const importName = imp.match(regexPackage)![1];
          importsSave.push(importName);
        }
      }

      if (importsSave.includes("sequelize")) {
        importsSave.push("pg");
        importsSave.push("pg-hstore");
      }

      if (importsSave.includes("nodemailer")) {
        execSync(`npm i --save-dev @types/nodemailer`, {cwd: pathFolder});
      }

      const importsSaveUnique = [...new Set(importsSave)];
      console.log(importsSaveUnique)

      for (const imp of importsSaveUnique) {
        execSync(`npm install ${imp}`, {cwd: pathFolder});
      }

      console.log("Project created successfully.");
      return 0;
    } catch (error) {
      console.error(error)
      throw error;
    }
  }
}

(async () => {
  console.log("Create the project..");
  const backendService = new BackendService();

  // Create the project Crud APP
  await backendService.createTheProject(
    "UserService",
    "create, delete, update, read",
    "Asigura-te ca returnezi userul la functia de create. la functia de update la fel, returnezi userul. la functia de delete returnezi da sau nu. la functia de get returnezi userul.",
    "mongoose",
    "mongodb+srv://miloiuc4:mPcKjbBivX7Yo7YV@cluster0.2xtg8qs.mongodb.net/");

  //Send mail
  await backendService.createTheProject(
    "EmailService",
    "sendMail",
    "Create a class that send an email with nodemailer, the function should return a boolean if the email was sent or not.",
    "",
    "");

  console.log("Successfully created the project.");
})();

