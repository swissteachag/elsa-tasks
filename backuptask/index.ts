import tl = require('azure-pipelines-task-lib/task');
import axios from 'axios';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

async function run() {
    try {

        // Get inputs ==================================================================       
        const bearerToken: string | undefined  = tl.getInput('bearerToken', false) || '';
        const backuptElsaServerUrl: string | undefined = tl.getInput('backupElsaServerUrl', true);
        const outputPath: string | undefined = tl.getInput('backupOutputPath', true);
        const backupIds: string | undefined = tl.getInput('backupIds', false) || '';
        
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

        type AxiosConfigBackup = {
            headers: { 
                "Content-Type": string;
                Authorization?: string;
            },
        };      

        const axiosconfigbackup: AxiosConfigBackup = {
            headers: { 
                "Content-Type": "application/json",
            },
        };      

        if (bearerToken) {
            axiosconfigbackup.headers["Authorization"] = `Bearer ${bearerToken}`;
        }

        if (!existsSync(`${outputPath}`)) {
            mkdirSync(`${outputPath}`, { recursive: true });
        }

        let endpoint = `${backuptElsaServerUrl}/v1/workflow-definitions/backup`;
        if (backupIds && backupIds.length > 0) {
            endpoint = `${backuptElsaServerUrl}/v1/workflow-definitions/backup?ids=${backupIds}`;
        }        

        const backup_response = await axios.get(endpoint, {
            headers: axiosconfigbackup.headers,
            responseType: "arraybuffer"
        });

        if (backup_response.status === 200 && backup_response.data) {
            const contentDispositionHeader = backup_response.headers['content-disposition'];
            const filename = contentDispositionHeader.split(';')[1].trim().split('=')[1].replace(/"/g, '');
            writeFileSync(outputPath + filename, backup_response.data);
        }
        else {
            tl.setResult(tl.TaskResult.Failed, 'No response from server');
            return;
        };

        // ================================================================================
           
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, (err as Error).message);
    }
}

run();