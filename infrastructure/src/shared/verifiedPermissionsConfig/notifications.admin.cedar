permit (
    principal,
    action in [
 		Agie::Action::"CreateSubscription",
		Agie::Action::"ListSubscriptions",
		Agie::Action::"DescribeSubscription",
		Agie::Action::"DeleteSubscription"
    ],
    resource
)
when {
    principal.custom.role == "admin"
};
