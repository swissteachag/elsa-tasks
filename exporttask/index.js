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
            const gtService = tl.getInput('gtService', true);
            const gtDomain = tl.getInput('gtDomain', false) || '';
            const username = tl.getInput('username', true);
            const password = tl.getInput('password', true);
            const gtFlowAPUrl = tl.getInput('gtFlowAPUrl', true);
            const elsaServerUrl = tl.getInput('elsaServerUrl', true);
            const outputPath = tl.getInput('outputPath', true);
            if (!gtService) {
                tl.setResult(tl.TaskResult.Failed, 'Gt Services URL is required');
                return;
            }
            if (!username) {
                tl.setResult(tl.TaskResult.Failed, 'Username is required');
                return;
            }
            if (!password) {
                tl.setResult(tl.TaskResult.Failed, 'Password is required');
                return;
            }
            if (!elsaServerUrl) {
                tl.setResult(tl.TaskResult.Failed, 'Elsa Server URL is required');
                return;
            }
            // Authorization - Get Bearer Token from GT =======================================
            console.log("Getting Bearer Token from GT");
            let gttoken;
            const basicAuthHeader = `Basic ${btoa(`${gtDomain}:${username}:${password}`)}`;
            const axiosconfiggt = {
                headers: {
                    "Authorization": basicAuthHeader,
                    "Content-Type": "application/json",
                },
            };
            const auth_response_gt = yield axios_1.default.get(gtService + '/suisvc/v1/auth', {
                headers: axiosconfiggt.headers
            });
            if (auth_response_gt.status === 200 && auth_response_gt.data) {
                gttoken = auth_response_gt.data.jwtSecurityToken;
            }
            else {
                tl.setResult(tl.TaskResult.Failed, 'No response from server');
                return;
            }
            ;
            // ================================================================================
            // Authorization - Get accesstoken for external Use from GT =======================
            console.log("Getting accesstoken for external Use from GT");
            let gtguid;
            const axiosconfiggtguid = {
                headers: {
                    "Authorization": `Bearer ${gttoken}`,
                    "Content-Type": "application/json",
                },
            };
            const auth_response_gtguid = yield axios_1.default.get(gtService + '/suisvc/v1/auth/getAccessTokenForExternalUse', {
                headers: axiosconfiggtguid.headers
            });
            if (auth_response_gtguid.status === 200 && auth_response_gtguid.data) {
                gtguid = auth_response_gtguid.data.value;
            }
            else {
                tl.setResult(tl.TaskResult.Failed, 'No response from server');
                return;
            }
            ;
            // ================================================================================
            // Authorization - Get bearer token from GT Flow ==================================
            console.log("Getting bearer token from GT Flow");
            let gtflowtoken;
            const auth_response_gtflow = yield axios_1.default.get(gtFlowAPUrl + '/api/Auth/' + gtguid, {});
            if (auth_response_gtflow.status === 200 && auth_response_gtflow.data) {
                gtflowtoken = auth_response_gtflow.data;
            }
            else {
                tl.setResult(tl.TaskResult.Failed, 'No response from server');
                return;
            }
            ;
            // ================================================================================
            // List all Workflow Definitions ==================================================
            console.log("Getting all workflow definitions");
            let wfditems;
            const axiosconfigwfitems = {
                headers: {
                    "Authorization": `Bearer ${gtflowtoken}`,
                    "Content-Type": "application/json",
                },
            };
            const auth_response_wfitems = yield axios_1.default.get(elsaServerUrl + '/v1/workflow-definitions?version=LatestOrPublished', {
                headers: axiosconfigwfitems.headers
            });
            if (auth_response_wfitems.status === 200 && auth_response_wfitems.data) {
                wfditems = auth_response_wfitems.data.items.map((item) => item.id);
            }
            else {
                tl.setResult(tl.TaskResult.Failed, 'No response from server');
                return;
            }
            ;
            // ================================================================================
            // Export and save workflow definitions=============================================
            console.log("Exporting and saving all workflow definitions");
            for (const item of wfditems !== null && wfditems !== void 0 ? wfditems : []) {
                const axiosconfigwfd = {
                    headers: {
                        "Authorization": `Bearer ${gtflowtoken}`,
                        "Content-Type": "application/json",
                    },
                };
                const response = yield axios_1.default.get(`${elsaServerUrl}/v1/workflow-definitions/${item}`, {
                    headers: axiosconfigwfd.headers
                });
                if (response.status === 200 && response.data) {
                    const fileName = `${item}.json`;
                    const filePath = `${outputPath}/${fileName}`;
                    const fileContent = JSON.stringify(response.data);
                    (0, fs_1.writeFileSync)(filePath, fileContent);
                }
                else {
                    tl.setResult(tl.TaskResult.Failed, 'No response from server');
                    return;
                }
                ;
            }
            // ================================================================================
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        }
    });
}
run();
