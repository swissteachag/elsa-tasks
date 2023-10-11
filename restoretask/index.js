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
const fs_1 = __importDefault(require("fs"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get inputs ==================================================================       
            const bearerToken = tl.getInput('bearerToken', false);
            const ElsaServerUrl = tl.getInput('restoreElsaServerUrl', true);
            const inputPath = tl.getInput('restoreInputPath', true);
            const deleteExistingWFDefinitions = tl.getInput('restoreDeleteExistingWFDefinitions', true);
            const restorePublishVersion = tl.getInput('restorePublishVersion', true);
            const restoreDeleteAfterRestore = tl.getInput('restoreDeleteAfterRestore', true);
            if (!ElsaServerUrl) {
                tl.setResult(tl.TaskResult.Failed, 'Elsa Server URL is required');
                return;
            }
            // Delete all Workflow Definitions if selected ====================================
            if (deleteExistingWFDefinitions === "true") {
                console.log("Getting all workflow definitions from current system");
                let importwfditems = [];
                const axiosconfigwfitems = {
                    headers: {
                        "Authorization": `Bearer ${bearerToken}`,
                        "Content-Type": "application/json",
                    },
                };
                const auth_response_wfitems = yield axios_1.default.get(ElsaServerUrl + '/v1/workflow-definitions?version=LatestOrPublished', {
                    headers: axiosconfigwfitems.headers
                });
                if (auth_response_wfitems.status === 200 && auth_response_wfitems.data) {
                    importwfditems = auth_response_wfitems.data.items.map((item) => new Object({ definitionId: item.definitionId, version: item.version }));
                    for (const deleteitem of importwfditems !== null && importwfditems !== void 0 ? importwfditems : []) {
                        const response_publish = yield axios_1.default.delete(`${ElsaServerUrl}/v1/workflow-definitions/${deleteitem.definitionId}/AllVersions`, {
                            headers: {
                                "Authorization": `Bearer ${bearerToken}`,
                                "Content-Type": "application/json"
                            },
                        });
                        if (response_publish.status === 202) {
                            console.log("workflow definition deleted: " + deleteitem.definitionId);
                        }
                        else {
                            tl.setResult(tl.TaskResult.Failed, 'Deletion failed' + deleteitem.definitionId);
                            return;
                        }
                        ;
                    }
                    ;
                }
                else {
                    tl.setResult(tl.TaskResult.Failed, 'No response from server');
                    return;
                }
                ;
            }
            // ================================================================================
            // Calling restore endpoint ========================================================
            console.log("Restoring from backup");
            const axiosconfigrestore = {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            };
            if (bearerToken) {
                axiosconfigrestore.headers["Authorization"] = `Bearer ${bearerToken}`;
            }
            const zipFiles = inputPath ? fs_1.default.readdirSync(inputPath !== null && inputPath !== void 0 ? inputPath : '').filter(file => file.endsWith('.zip')) : [];
            const newestZipFile = zipFiles.reduce((prev, curr) => {
                const prevDate = fs_1.default.statSync(`${inputPath}/${prev}`).mtime;
                const currDate = fs_1.default.statSync(`${inputPath}/${curr}`).mtime;
                return prevDate > currDate ? prev : curr;
            });
            const fileContent = fs_1.default.readFileSync(`${inputPath}` + newestZipFile);
            const formData = new FormData();
            formData.append('file', new Blob([Buffer.from(fileContent)]), newestZipFile);
            const response = yield axios_1.default.post(`${ElsaServerUrl}/v1/workflow-definitions/restore`, formData, {
                headers: axiosconfigrestore.headers
            });
            if (response.status === 200) {
                if (restoreDeleteAfterRestore === "true") {
                    fs_1.default.unlink(`${inputPath}` + newestZipFile, (err) => {
                        if (err)
                            throw err;
                        console.log(`${inputPath}${newestZipFile}` + ' was deleted');
                    });
                }
                console.log(restorePublishVersion);
                if (restorePublishVersion === "true") {
                    const axiosconfigrestore = {
                        headers: {
                            "Content-Type": "multipart/form-data",
                        },
                    };
                    if (bearerToken) {
                        axiosconfigrestore.headers["Authorization"] = `Bearer ${bearerToken}`;
                    }
                    // List all Workflow Definitions ==================================================
                    console.log("Getting all workflow definitions");
                    axiosconfigrestore.headers["Content-Type"] = "application/json";
                    const response_wfitems = yield axios_1.default.get(`${ElsaServerUrl}/v1/workflow-definitions?version=AllVersions`, {
                        headers: axiosconfigrestore.headers
                    });
                    if (response_wfitems.status === 200 && response_wfitems.data) {
                        const filteredItems = response_wfitems.data.items.filter((item) => item.isLatest && !item.isPublished && item.version === 1).map((item) => item.definitionId);
                        // Publish all workflow definitions that are version 1, are not published and are latest ===============
                        console.log("Publish workflow definitions");
                        for (const item of filteredItems !== null && filteredItems !== void 0 ? filteredItems : []) {
                            axiosconfigrestore.headers["Content-Type"] = "application/json";
                            if (bearerToken) {
                                axiosconfigrestore.headers["Authorization"] = `Bearer ${bearerToken}`;
                            }
                            const response_publish = yield axios_1.default.post(`${ElsaServerUrl}/v1/workflow-definitions/${item}/publish`, {
                                headers: axiosconfigrestore.headers
                            });
                            if (response_publish.status === 202 && response_publish.data) {
                                console.log(response_publish.data.definitionId);
                            }
                            else {
                                tl.setResult(tl.TaskResult.Failed, 'Publish failed');
                                return;
                            }
                            ;
                        }
                    }
                    else {
                        tl.setResult(tl.TaskResult.Failed, 'No response from server');
                        return;
                    }
                    ;
                }
                else {
                    console.log("Publishing was disabled");
                }
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
