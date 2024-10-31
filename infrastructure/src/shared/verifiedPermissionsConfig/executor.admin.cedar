permit (
    principal,
    action in [
        Agie::Action::"CreateExecutionTask",
        Agie::Action::"DescribeExecutionTask",
        Agie::Action::"ListExecutionTasks",

        Agie::Action::"DescribeExecutionTaskItem",
        Agie::Action::"ListExecutionTaskItems"
    ],
    resource
)
when {
    principal.custom.role == "admin"
};
