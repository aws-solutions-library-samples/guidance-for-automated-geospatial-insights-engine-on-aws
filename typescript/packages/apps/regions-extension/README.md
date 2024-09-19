# Regions Extension Module

## Overview

The `Regions Extension` module updates the attributes of AGIE `Region` resources with latest analysis result for a region. You can use this module as a template to augment your `Region` resources (Groups, Regions or Polygon) with external or aggregated data.

## Architecture

### AGIE Conceptual Architecture

![conceptual](docs/images/AGIE%20HLA-regions-extension-conceptual.png)

The `Regions Extension` module subscribes to analysis results CRUD events from `Results` module and update the associated region resource attributes with latest analysis result details.

### Regions Extension Logical Architecture

![logical](docs/images/AGIE%20HLA-regions-extension.png)

The `Regions Extension` AWS Lambda subscribes to `Result` module events from the shared Amazon EventBridge and update the `Region` resource by invoking the `Region` module API Lambda.
