
};

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Dashboard] Fatal error starting dashboard:', err);
  process.exit(1);
});
