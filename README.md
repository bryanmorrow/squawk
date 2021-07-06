# squawk

# testing locally
Run with:
```
echo '{"subdomain": "demo", "username": "some-admin-user@redcanary.com", "password": "XXXXXXX"}' | sam local invoke --event -
```

Results are dumped into the S3 bucket `rc-portal-performance-stats`