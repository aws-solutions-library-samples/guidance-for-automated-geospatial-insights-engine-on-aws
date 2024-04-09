#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { EngineStack } from "./engine/engine.stack";

const app = new App();

new EngineStack(app, 'EngineModule', {})
