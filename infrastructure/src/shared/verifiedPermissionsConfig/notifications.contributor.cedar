permit (
    principal,
    action in [
   		Arcade::Action::"CreateSubscription",
		Arcade::Action::"ListSubscriptions",
		Arcade::Action::"DescribeSubscription",
		Arcade::Action::"DeleteSubscription"
    ],
    resource
)
when {
    principal.custom.role == "contributor"
};
