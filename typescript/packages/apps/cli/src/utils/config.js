"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var conf_1 = require("conf");
var config = new conf_1.default({
    projectName: 'arcade',
    schema: {
        stacServerPath: {
            type: 'string',
        },
        stacServerApiLambdaFunctionName: {
            type: 'string',
        },
        stacServerIngestionLambdaFunctionName: {
            type: 'string',
        },
        stacServerInitializerLambdaFunctionName: {
            type: 'string',
        },
        stacServerIngestionTopicArn: {
            type: 'string',
        },
        stacServerOpenSearchEndPoint: {
            type: 'string',
        },
        stacServerOpenSearchAccessPolicy: {
            type: 'string',
        },
        arcadePath: {
            type: 'string',
        },
        arcadeEventBridgeName: {
            type: 'string',
        },
    },
});
exports.default = config;
