permit (
    principal,
    action in [
        Arcade::Action::"ListResults",
        Arcade::Action::"DescribeResult"
    ],
    resource
)
when {
    principal.custom.role == "reader"
};
