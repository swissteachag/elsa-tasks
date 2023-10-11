"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const axios_1 = __importDefault(require("axios"));
const fs_1 = require("fs");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get inputs ==================================================================       
            const bearerToken = tl.getInput('bearerToken', false) || '';
            const backuptElsaServerUrl = tl.getInput('backupElsaServerUrl', true);
            const outputPath = tl.getInput('backupOutputPath', true);
            const backupIds = tl.getInput('backupIds', false) || '';
            if (!backuptElsaServerUrl) {
                tl.setResult(tl.TaskResult.Failed, 'Elsa Server URL is required');
                return;
            }
            if (!outputPath) {
                tl.setResult(tl.TaskResult.Failed, 'Output path is required');
                return;
            }
            // Calling backup endpoint ========================================================
            console.log("Calling backup endpoint");
            const axiosconfigbackup = {
                headers: {
                    "Content-Type": "application/json",
                },
            };
            if (bearerToken) {
                axiosconfigbackup.headers["Authorization"] = `Bearer ${bearerToken}`;
            }
            if (!(0, fs_1.existsSync)(`${outputPath}`)) {
                (0, fs_1.mkdirSync)(`${outputPath}`, { recursive: true });
            }
            let endpoint = `${backuptElsaServerUrl}/v1/workflow-definitions/backup`;
            if (backupIds && backupIds.length > 0) {
                endpoint = `${backuptElsaServerUrl}/v1/workflow-definitions/backup?ids=${backupIds}`;
            }
            const backup_response = yield axios_1.default.get(endpoint, {
                headers: axiosconfigbackup.headers,
                responseType: "arraybuffer"
            });
            if (backup_response.status === 200 && backup_response.data) {
                const contentDispositionHeader = backup_response.headers['content-disposition'];
                const filename = contentDispositionHeader.split(';')[1].trim().split('=')[1].replace(/"/g, '');
                (0, fs_1.writeFileSync)(outputPath + filename, backup_response.data);
            }
            else {
                tl.setResult(tl.TaskResult.Failed, 'No response from server');
                return;
            }
            ;
            // ================================================================================
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        }
    });
}
run();
