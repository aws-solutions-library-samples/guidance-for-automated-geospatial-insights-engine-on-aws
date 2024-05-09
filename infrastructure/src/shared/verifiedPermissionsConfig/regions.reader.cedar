permit (
    principal,
    action in [
        Arcade::Action::"ListGroups",
        Arcade::Action::"DescribeGroup",

        Arcade::Action::"ListRegions",
        Arcade::Action::"DescribeRegion",

        Arcade::Action::"ListPolygons",
        Arcade::Action::"DescribePolygon",

        Arcade::Action::"ListStates",
        Arcade::Action::"DescribeState"
    ],
    resource
)
when {
    principal.custom.role == "reader"
};
