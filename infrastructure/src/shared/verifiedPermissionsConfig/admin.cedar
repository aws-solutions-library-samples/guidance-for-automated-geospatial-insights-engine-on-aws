permit (
    principal,
    action in [
        Arcade::Action::"CreateGroup",
        Arcade::Action::"ListGroups",
        Arcade::Action::"DescribeGroup",
        Arcade::Action::"UpdateGroup",
        Arcade::Action::"DeleteGroup",

        Arcade::Action::"CreateRegion",
        Arcade::Action::"ListRegions",
        Arcade::Action::"DescribeRegion",
        Arcade::Action::"UpdateRegion",
        Arcade::Action::"DeleteRegion",

        Arcade::Action::"CreatePolygon",
        Arcade::Action::"ListPolygons",
        Arcade::Action::"DescribePolygon",
        Arcade::Action::"UpdatePolygon",
        Arcade::Action::"DeletePolygon",

        Arcade::Action::"CreateState",
        Arcade::Action::"ListStates",
        Arcade::Action::"DescribeState",
        Arcade::Action::"UpdateState",
        Arcade::Action::"DeleteState"
    ],
    resource
)
when {
    principal.custom.role == "admin"
};
