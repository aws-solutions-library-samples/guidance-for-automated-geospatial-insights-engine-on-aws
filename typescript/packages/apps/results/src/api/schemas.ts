import { Static, Type } from '@sinclair/typebox';
import { stringEnum } from '../common/types.js'

export const state = stringEnum(['started', 'queued', 'inProgress', 'failed', 'succeeded'], 'The state of the pipeline');

export const pipelineMetadata =  Type.Object({
    id: Type.String({description: 'The id of the pipeline'}),
    executionId: Type.String({description: 'The id of the execution'}),
    executionArn: Type.Optional(Type.String({description: 'The StepFunction execution Arn'})),
    createdAt: Type.String({description: 'The creation time of the execution'}),
    updatedAt: Type.Optional(Type.String({description: 'The update time of the execution'})),
    state,
    message: Type.Optional(Type.String({description: 'The failure reason'})),
});

export const count = Type.Optional(
    Type.Integer({
        description: 'No. of results returned when pagination requested.'
    })
);
export const paginationToken = Type.String({
    description: 'Token used to paginate to the next page of search result.'
})

export const pipelineMetadataListOptions = Type.Object(
    {
        count: Type.Optional(count),
        lastEvaluatedToken: Type.Optional(paginationToken)
    }
);

export const pipelineMetadataList = Type.Object(
    {
        pipelineMetadatas: Type.Array(Type.Ref(pipelineMetadata)),
        pagination: Type.Optional(
            pipelineMetadataListOptions
        ),
    },
    {
        $id: 'pipelineMetadataListResource',
    }
);

export type PipelineMetadata = Static<typeof pipelineMetadata>;
export type PipelineMetadataListOptions = Static<typeof pipelineMetadataListOptions>;
export type PipelineMetadataList = Static<typeof pipelineMetadataList>;
