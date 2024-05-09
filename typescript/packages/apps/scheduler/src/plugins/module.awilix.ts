import pkg from 'aws-xray-sdk';
import { Cradle, diContainer, FastifyAwilixOptions, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SchedulesService } from "../schedules/service.js";

const { captureAWSv3Client } = pkg;

declare module '@fastify/awilix' {
    interface Cradle {
        schedulerClient: SchedulerClient;
        schedulesService: SchedulesService;
    }
}

class SchedulerClientFactory {
    public static create(region: string | undefined): SchedulerClient {
        return captureAWSv3Client(new SchedulerClient({ region }));
    }
}


const registerContainer = (app?: FastifyInstance) => {
    const commonInjectionOptions = {
        lifetime: Lifetime.SINGLETON
    };

    const awsRegion = process.env['AWS_REGION'];
    const schedulerGroup = process.env['SCHEDULER_GROUP'];
    const sqsArn = process.env['SQS_ARN'];
    const roleArn: string = process.env['ROLE_ARN'];

    diContainer.register({
        // Clients
        schedulerClient: asFunction(() => SchedulerClientFactory.create(awsRegion), {
            ...commonInjectionOptions
        }),

        schedulesService: asFunction(
            (c: Cradle) => new SchedulesService(app.log, c.schedulerClient, schedulerGroup, sqsArn, roleArn),
            {
                ...commonInjectionOptions,
            }
        ),

    });
};

export default fp<FastifyAwilixOptions>(async (app: FastifyInstance): Promise<void> => {
    // first register the DI plugin
    await app.register(fastifyAwilixPlugin, {
        disposeOnClose: true,
        disposeOnResponse: false
    });

    registerContainer(app);
});

export { registerContainer };
