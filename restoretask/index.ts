import tl = require('azure-pipelines-task-lib/task');
import axios from 'axios';
import fs from 'fs';

async function run() {
    try {

        // Get inputs ==================================================================       
        const bearerToken: string | undefined = tl.getInput('bearerToken', false);
        const ElsaServerUrl: string | undefined = tl.getInput('restoreElsaServerUrl', true);
        const inputPath: string | undefined = tl.getInput('restoreInputPath', true);
        const deleteExistingWFDefinitions: string | undefined = tl.getInput('restoreDeleteExistingWFDefinitions', true);        
        const restorePublishVersion: string | undefined = tl.getInput('restorePublishVersion', true);
        const restoreDeleteAfterRestore: string | undefined = tl.getInput('restoreDeleteAfterRestore', true);
                
        if (!ElsaServerUrl) {
            tl.setResult(tl.TaskResult.Failed, 'Elsa Server URL is required');
            return;
        }

       // Delete all Workflow Definitions if selected ====================================
        
       if (deleteExistingWFDefinitions === "true") {

        console.log("Getting all workflow definitions from current system");
        let importwfditems: any [] = [];
        const axiosconfigwfitems = {
            headers: { 
                "Authorization": `Bearer ${bearerToken}`, 
                "Content-Type": "application/json",
            },
        };      
        const auth_response_wfitems = await axios.get(ElsaServerUrl + '/v1/workflow-definitions?version=LatestOrPublished', {
            headers: axiosconfigwfitems.headers
        });
        
        if (auth_response_wfitems.status === 200 && auth_response_wfitems.data) {
            importwfditems = auth_response_wfitems.data.items.map((item: any) => new Object ({definitionId: item.definitionId, version: item.version}));
        
            for (const deleteitem of importwfditems ?? []) {
                const response_publish = await axios.delete(`${ElsaServerUrl}/v1/workflow-definitions/${deleteitem.definitionId}/AllVersions`,  {
                    headers: {
                        "Authorization": `Bearer ${bearerToken}`, 
                        "Content-Type": "application/json"
                    },
                });

                if (response_publish.status === 202) {

                    console.log("workflow definition deleted: " + deleteitem.definitionId);

                }  
                else {
                    tl.setResult(tl.TaskResult.Failed, 'Deletion failed'+ deleteitem.definitionId);
                    return;
                }; 
            };
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'No response from server');
            return;
        };
    
    }
    // ================================================================================

    // Calling restore endpoint ========================================================
    console.log("Restoring from backup");

    type AxiosConfig = {
        headers: { 
            "Content-Type": string;
            Authorization?: string;
        },
    };      

    const axiosconfigrestore: AxiosConfig = {
        headers: { 
            "Content-Type": "multipart/form-data",
        },
    };      

    if (bearerToken) {
        axiosconfigrestore.headers["Authorization"] = `Bearer ${bearerToken}`;
    }

    const zipFiles = inputPath ? fs.readdirSync(inputPath ?? '').filter(file => file.endsWith('.zip')) : [];
    const newestZipFile = zipFiles.reduce((prev, curr) => {
        const prevDate = fs.statSync(`${inputPath}/${prev}`).mtime;
        const currDate = fs.statSync(`${inputPath}/${curr}`).mtime;
        return prevDate > currDate ? prev : curr;
    });
        
    const fileContent = fs.readFileSync(`${inputPath}` + newestZipFile);
    const formData = new FormData();
    formData.append('file', new Blob([Buffer.from(fileContent)]), newestZipFile);

    const response = await axios.post(`${ElsaServerUrl}/v1/workflow-definitions/restore`, formData, {
        headers: axiosconfigrestore.headers
    });

    if (response.status === 200) {
        
          if (restoreDeleteAfterRestore === "true") {
  
            fs.unlink(`${inputPath}` + newestZipFile, (err) => {
                if (err) throw err;
                console.log(`${inputPath}${newestZipFile}` + ' was deleted');
            });

        } 

        if (restorePublishVersion === "true") {

            const axiosconfigrestore: AxiosConfig = {
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
            const response_wfitems = await axios.get(`${ElsaServerUrl}/v1/workflow-definitions?version=AllVersions`, {
                headers: axiosconfigrestore.headers
            });
                
            if (response_wfitems.status === 200 && response_wfitems.data) {
                const filteredItems = response_wfitems.data.items.filter((item: any) => item.isLatest && !item.isPublished && item.version === 1).map((item: any) => item.definitionId);

                // Publish all workflow definitions that are version 1, are not published and are latest ===============
                console.log("Publish workflow definitions");
                
                for (const item of filteredItems ?? []) {
        
                    axiosconfigrestore.headers["Content-Type"] = "application/json";
                    if (bearerToken) {
                        axiosconfigrestore.headers["Authorization"] = `Bearer ${bearerToken}`;
                    }
                    const response_publish = await axios.post(`${ElsaServerUrl}/v1/workflow-definitions/${item}/publish`,  {
                        headers: axiosconfigrestore.headers
                    });
            
                    if (response_publish.status === 202 && response_publish.data) {
                        console.log(response_publish.data.definitionId);
                    }  
                    else {
                        tl.setResult(tl.TaskResult.Failed, 'Publish failed');
                        return;
                    }; 
        
                }
        
            }
            else {
                tl.setResult(tl.TaskResult.Failed, 'No response from server');
                return;
            };

        } else {
            console.log("Publishing was disabled");
        }


    }; 

    // ================================================================================
           
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, (err as Error).message);
    }
}

run();