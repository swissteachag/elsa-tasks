import tl = require('azure-pipelines-task-lib/task');
import axios from 'axios';
import { writeFileSync } from 'fs';

async function run() {
    try {

        // Get inputs ==================================================================       
        const gtService: string | undefined = tl.getInput('gtService', true);
        const gtDomain: string = tl.getInput('gtDomain', false) || '';
        const username: string | undefined = tl.getInput('username', true);
        const password: string | undefined = tl.getInput('password', true);
        const gtFlowAPUrl: string | undefined = tl.getInput('gtFlowAPUrl', true);
        const elsaServerUrl: string | undefined = tl.getInput('elsaServerUrl', true);
        const outputPath: string | undefined = tl.getInput('outputPath', true);

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

        let gttoken: string | undefined;
        const basicAuthHeader = `Basic ${btoa(`${gtDomain}:${username}:${password}`)}`;
        const axiosconfiggt = {
            headers: { 
                "Authorization": basicAuthHeader, 
                "Content-Type": "application/json",
            },
        };        

        const auth_response_gt = await axios.get(gtService + '/suisvc/v1/auth', {
            headers: axiosconfiggt.headers
        });

        if (auth_response_gt.status === 200 && auth_response_gt.data) {
            gttoken = auth_response_gt.data.jwtSecurityToken;
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'No response from server');
            return;
        };
        // ================================================================================

        // Authorization - Get accesstoken for external Use from GT =======================
        console.log("Getting accesstoken for external Use from GT");
        
        let gtguid: string | undefined;
        const axiosconfiggtguid = {
            headers: { 
                "Authorization": `Bearer ${gttoken}`, 
                "Content-Type": "application/json",
            },
        };      
        const auth_response_gtguid = await axios.get(gtService + '/suisvc/v1/auth/getAccessTokenForExternalUse', {
            headers: axiosconfiggtguid.headers
        });

        if (auth_response_gtguid.status === 200 && auth_response_gtguid.data) {
            gtguid = auth_response_gtguid.data.value;
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'No response from server');
            return;
        };
        // ================================================================================

        // Authorization - Get bearer token from GT Flow ==================================
        console.log("Getting bearer token from GT Flow");

        let gtflowtoken: string | undefined;
        const auth_response_gtflow = await axios.get(gtFlowAPUrl + '/api/Auth/' + gtguid, {});

        if (auth_response_gtflow.status === 200 && auth_response_gtflow.data) {
            gtflowtoken = auth_response_gtflow.data;
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'No response from server');
            return;
        };
        // ================================================================================
 

        // List all Workflow Definitions ==================================================
        console.log("Getting all workflow definitions");

        let wfditems: string | undefined;
        const axiosconfigwfitems = {
            headers: { 
                "Authorization": `Bearer ${gtflowtoken}`, 
                "Content-Type": "application/json",
            },
        };      
        const auth_response_wfitems = await axios.get(elsaServerUrl + '/v1/workflow-definitions?version=LatestOrPublished', {
            headers: axiosconfigwfitems.headers
        });

        if (auth_response_wfitems.status === 200 && auth_response_wfitems.data) {
            wfditems = auth_response_wfitems.data.items.map((item: any) => item.id);
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'No response from server');
            return;
        };
        // ================================================================================

        // Export and save workflow definitions=============================================
        console.log("Exporting and saving all workflow definitions");

        for (const item of wfditems ?? []) {
                const axiosconfigwfd = {
                headers: { 
                    "Authorization": `Bearer ${gtflowtoken}`, 
                    "Content-Type": "application/json",
                },
            };
            const response = await axios.get(`${elsaServerUrl}/v1/workflow-definitions/${item}`, {
                headers: axiosconfigwfd.headers
            });
            if (response.status === 200 && response.data) {
                const fileName = `${item}.json`;
                const filePath = `${outputPath}/${fileName}`;
                const fileContent = JSON.stringify(response.data);
                writeFileSync(filePath, fileContent);
            }
            else {
                tl.setResult(tl.TaskResult.Failed, 'No response from server');
                return;
            };
        }
        // ================================================================================
   
        
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, (err as Error).message);
    }
}

run();