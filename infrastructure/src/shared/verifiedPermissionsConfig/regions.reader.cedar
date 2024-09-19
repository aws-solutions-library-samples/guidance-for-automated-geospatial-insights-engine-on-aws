permit (
    principal,
    action in [
        Agie::Action::"ListGroups",
        Agie::Action::"DescribeGroup",

        Agie::Action::"ListRegions",
        Agie::Action::"DescribeRegion",

        Agie::Action::"ListPolygons",
        Agie::Action::"DescribePolygon",

        Agie::Action::"ListStates",
        Agie::Action::"DescribeState",

        Agie::Action::"ListRegionTasks",
        Agie::Action::"DescribeRegionTask",
        Agie::Action::"ListRegionTaskItems",
        Agie::Action::"DescribeRegionTaskItem",

        Agie::Action::"ListPolygonTasks",
        Agie::Action::"DescribePolygonTask",
        Agie::Action::"ListPolygonTaskItems",
        Agie::Action::"DescribePolygonTaskItem"
    ],
    resource
)
when {
    principal.custom.role == "reader"
};
