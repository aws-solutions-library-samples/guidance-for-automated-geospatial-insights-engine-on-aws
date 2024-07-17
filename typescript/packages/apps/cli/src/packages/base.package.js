"use strict";
/*
 *    Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *    with the License. A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *    OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *    and limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePackage = void 0;
var os = require("os");
var BasePackage = /** @class */ (function () {
    function BasePackage(logger) {
        this.logger = logger;
    }
    BasePackage.prototype.getTasks = function () {
        switch (os.platform()) {
            case "darwin":
                return this.getMacTasks();
            case "linux":
                return this.getLinuxTasks();
            case "win32":
                return this.getWindowsTasks();
            default:
                this.logger.error("the platform is not supported");
                return [];
        }
    };
    return BasePackage;
}());
exports.BasePackage = BasePackage;
